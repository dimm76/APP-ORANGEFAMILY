async function request(path, options = {}) {
  const response = await fetch(path, { ...options, credentials: "include", headers: options.body ? { "Content-Type": "application/json", ...options.headers } : options.headers });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || "No se pudo completar la operación.");
  return data;
}

export const listFamilyMembers = () => request("/api/settings/family-members");
export const createFamilyMember = (body) => request("/api/settings/family-members", { method: "POST", body: JSON.stringify(body) });
export const updateFamilyMember = (id, body) => request(`/api/settings/family-members/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
export const resendInvitation = (id) => request(`/api/settings/family-members/${encodeURIComponent(id)}/resend-invitation`, { method: "POST", body: "{}" });
export const sendMemberPasswordReset = (id) => request(`/api/settings/family-members/${encodeURIComponent(id)}/send-password-reset`, { method: "POST", body: "{}" });
