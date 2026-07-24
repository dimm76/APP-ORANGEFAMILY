package com.orangefamily.photossync.auth

import org.json.JSONObject

data class AuthPerson(
    val firstName: String,
    val lastName: String?,
    val preferredName: String?,
    val displayName: String?,
)

data class FamilyMembership(
    val id: String,
    val name: String,
    val role: String,
)

data class AuthUser(
    val id: String,
    val email: String,
    val person: AuthPerson?,
    val families: List<FamilyMembership>,
) {
    val name: String?
        get() = person?.displayName?.takeIf(String::isNotBlank)
            ?: listOfNotNull(person?.firstName, person?.lastName)
                .joinToString(" ")
                .takeIf(String::isNotBlank)

    companion object {
        fun fromJson(json: JSONObject): AuthUser {
            val personJson = json.optJSONObject("person")
            val person = personJson?.let {
                AuthPerson(
                    firstName = it.optString("first_name"),
                    lastName = it.nullableString("last_name"),
                    preferredName = it.nullableString("preferred_name"),
                    displayName = it.nullableString("display_name"),
                )
            }
            val familiesJson = json.optJSONArray("families")
            val families = buildList {
                if (familiesJson != null) {
                    for (index in 0 until familiesJson.length()) {
                        val family = familiesJson.optJSONObject(index) ?: continue
                        add(
                            FamilyMembership(
                                id = family.getString("id"),
                                name = family.getString("name"),
                                role = family.getString("role"),
                            ),
                        )
                    }
                }
            }
            return AuthUser(
                id = json.getString("id"),
                email = json.getString("email"),
                person = person,
                families = families,
            )
        }
    }
}

private fun JSONObject.nullableString(name: String): String? =
    if (isNull(name)) null else optString(name).takeIf(String::isNotBlank)
