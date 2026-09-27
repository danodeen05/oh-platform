export type TeamRole = "owner" | "manager" | "station";
export type TeamMember = { userId: string; email: string; name: string; role: TeamRole; locked: boolean };
export type TeamInvite = { id: string; email: string; role: "manager" | "station"; createdAt: string };
export type TeamPayload = { members: TeamMember[]; invites: TeamInvite[] };

export const INVITE_ROLES = ["manager", "station"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

export const ROLE_LABEL: Record<TeamRole, string> = { owner: "Owner", manager: "Manager", station: "Station" };

/** Shown on the Invite sheet, and next to the role Select for an existing member. */
export const ROLE_EXPLANATION: Record<InviteRole, string> = {
  manager: "Day-to-day tools. No plan access, money reports, setup or card refunds.",
  station: "Kitchen and Cleaning displays only. For shared tablets.",
};

/** Locked owners (the allowlist) first, then everyone else by name. */
export function sortMembers(members: TeamMember[]): TeamMember[] {
  return [...members].sort((a, b) => {
    if (a.locked !== b.locked) return a.locked ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
