/** Trusted backend session boundary. No Gmail, database, or publication side effects. */
export type AdminSession={source:"verified_server_session";adminId:string;role:"publisher"|"editor"|"none";aal:"aal2"|"aal1"|"unknown";mfaAt:number;loginAt:number};
export function checkTrustedAdminSession(session:AdminSession|null,now:number):boolean{
 return !!session && session.source==="verified_server_session"
 && !!session.adminId && (session.role==="publisher"||session.role==="editor")
 && session.aal==="aal2" && Number.isFinite(now)
 && Number.isFinite(session.mfaAt) && Number.isFinite(session.loginAt)
 && session.mfaAt<=now && session.loginAt<=now
 && now-session.mfaAt<=300000 && now-session.loginAt<=1800000;
}
