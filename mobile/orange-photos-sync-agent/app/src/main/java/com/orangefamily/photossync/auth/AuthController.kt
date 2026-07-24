package com.orangefamily.photossync.auth

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class AuthController(
    private val api: OrangeFamilyAuthApi,
    private val sessionStore: SecureSessionStore,
) {
    var state by mutableStateOf<AuthState>(AuthState.Loading)
        private set

    private var sessionToken: String? = null

    fun restore(scope: CoroutineScope) {
        scope.launch {
            val storedToken = withContext(Dispatchers.IO) { sessionStore.load(api.baseUrl) }
            if (storedToken == null) {
                state = AuthState.LoggedOut()
                return@launch
            }
            sessionToken = storedToken
            when (val result = safeCurrentUser(storedToken)) {
                is OrangeFamilyAuthApi.CurrentUserResult.Success -> {
                    state = AuthState.Authenticated(result.user)
                }
                OrangeFamilyAuthApi.CurrentUserResult.Unauthorized -> clearSession()
                is OrangeFamilyAuthApi.CurrentUserResult.Failure -> {
                    state = AuthState.LoggedOut(result.message)
                }
            }
        }
    }

    fun login(scope: CoroutineScope, email: String, password: String) {
        if (email.isBlank() || password.isBlank() || state is AuthState.LoggingIn) return
        state = AuthState.LoggingIn
        scope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching { api.login(email, password) }
                    .getOrElse { OrangeFamilyAuthApi.LoginResult.Failure(NETWORK_ERROR) }
            }
            when (result) {
                is OrangeFamilyAuthApi.LoginResult.Success -> {
                    val stored = withContext(Dispatchers.IO) {
                        runCatching {
                            sessionStore.save(result.sessionToken, api.baseUrl)
                            true
                        }.getOrDefault(false)
                    }
                    if (stored) {
                        sessionToken = result.sessionToken
                        state = AuthState.Authenticated(result.user)
                    } else {
                        withContext(Dispatchers.IO) {
                            runCatching { api.logout(result.sessionToken) }
                        }
                        clearSession(SESSION_STORAGE_ERROR)
                    }
                }
                is OrangeFamilyAuthApi.LoginResult.Failure -> {
                    state = AuthState.LoggedOut(result.message)
                }
            }
        }
    }

    fun logout(scope: CoroutineScope) {
        if (state is AuthState.LoggingOut) return
        val token = sessionToken
        state = AuthState.LoggingOut
        scope.launch {
            if (token != null) {
                withContext(Dispatchers.IO) { runCatching { api.logout(token) } }
            }
            clearSession()
        }
    }

    private suspend fun safeCurrentUser(token: String): OrangeFamilyAuthApi.CurrentUserResult =
        withContext(Dispatchers.IO) {
            runCatching { api.currentUser(token) }
                .getOrElse { OrangeFamilyAuthApi.CurrentUserResult.Failure(NETWORK_ERROR) }
        }

    private suspend fun clearSession(message: String? = null) {
        withContext(Dispatchers.IO) { sessionStore.clear() }
        sessionToken = null
        state = AuthState.LoggedOut(message)
    }

    sealed interface AuthState {
        data object Loading : AuthState
        data object LoggingIn : AuthState
        data object LoggingOut : AuthState
        data class LoggedOut(val error: String? = null) : AuthState
        data class Authenticated(val user: AuthUser) : AuthState
    }

    private companion object {
        const val NETWORK_ERROR = "No se pudo conectar con OrangeFamily."
        const val SESSION_STORAGE_ERROR = "No se pudo proteger la sesión en este dispositivo."
    }
}
