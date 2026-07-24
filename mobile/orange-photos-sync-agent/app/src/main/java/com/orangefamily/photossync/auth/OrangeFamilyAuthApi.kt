package com.orangefamily.photossync.auth

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class OrangeFamilyAuthApi(apiBaseUrl: String) {
    val baseUrl: String = apiBaseUrl.trim().let {
        require(it.startsWith("http://") || it.startsWith("https://"))
        if (it.endsWith('/')) it else "$it/"
    }

    fun login(email: String, password: String): LoginResult {
        val body = JSONObject()
            .put("email", email.trim().lowercase())
            .put("password", password)
            .toString()
        val response = request("api/auth/login", "POST", body = body)
        if (response.status !in 200..299) {
            return LoginResult.Failure(response.publicMessage())
        }

        val user = response.json?.optJSONObject("user")?.let(AuthUser::fromJson)
            ?: return LoginResult.Failure(GENERIC_ERROR)
        val token = response.setCookies
            .firstNotNullOfOrNull(::sessionTokenFromSetCookie)
            ?: return LoginResult.Failure(GENERIC_ERROR)
        return LoginResult.Success(user, token)
    }

    fun currentUser(sessionToken: String): CurrentUserResult {
        val response = request("api/auth/me", "GET", sessionToken = sessionToken)
        if (response.status == HttpURLConnection.HTTP_UNAUTHORIZED) {
            return CurrentUserResult.Unauthorized
        }
        if (response.status !in 200..299) {
            return CurrentUserResult.Failure(response.publicMessage())
        }
        val user = response.json?.optJSONObject("user")?.let(AuthUser::fromJson)
            ?: return CurrentUserResult.Failure(GENERIC_ERROR)
        return CurrentUserResult.Success(user)
    }

    fun logout(sessionToken: String) {
        request("api/auth/logout", "POST", sessionToken, "{}")
    }

    private fun request(
        path: String,
        method: String,
        sessionToken: String? = null,
        body: String? = null,
    ): HttpResponse {
        val connection = URL(baseUrl + path).openConnection() as HttpURLConnection
        return try {
            connection.requestMethod = method
            connection.connectTimeout = CONNECT_TIMEOUT_MS
            connection.readTimeout = READ_TIMEOUT_MS
            connection.setRequestProperty("Accept", "application/json")
            if (sessionToken != null) {
                connection.setRequestProperty("Cookie", "$SESSION_COOKIE_NAME=$sessionToken")
            }
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.outputStream.use { output ->
                    output.write(body.toByteArray(Charsets.UTF_8))
                }
            }

            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val responseBody = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = responseBody.takeIf(String::isNotBlank)?.let {
                runCatching { JSONObject(it) }.getOrNull()
            }
            val setCookies = connection.headerFields.entries
                .filter { (name, _) -> name.equals("Set-Cookie", ignoreCase = true) }
                .flatMap { it.value.orEmpty() }
            HttpResponse(status, json, setCookies)
        } finally {
            connection.disconnect()
        }
    }

    private fun HttpResponse.publicMessage(): String =
        json?.optString("message")?.takeIf(String::isNotBlank) ?: GENERIC_ERROR

    private fun sessionTokenFromSetCookie(header: String): String? {
        val cookie = header.split(';').firstOrNull()?.trim().orEmpty()
        val prefix = "$SESSION_COOKIE_NAME="
        if (!cookie.startsWith(prefix)) return null
        return cookie.removePrefix(prefix).takeIf(String::isNotBlank)
    }

    private data class HttpResponse(
        val status: Int,
        val json: JSONObject?,
        val setCookies: List<String>,
    )

    sealed interface LoginResult {
        data class Success(val user: AuthUser, val sessionToken: String) : LoginResult
        data class Failure(val message: String) : LoginResult
    }

    sealed interface CurrentUserResult {
        data class Success(val user: AuthUser) : CurrentUserResult
        data class Failure(val message: String) : CurrentUserResult
        data object Unauthorized : CurrentUserResult
    }

    private companion object {
        const val SESSION_COOKIE_NAME = "of_session"
        const val CONNECT_TIMEOUT_MS = 15_000
        const val READ_TIMEOUT_MS = 20_000
        const val GENERIC_ERROR = "No se pudo conectar con OrangeFamily."
    }
}
