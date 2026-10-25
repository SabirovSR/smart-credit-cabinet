export const editable = ["DRAFT", "NEEDS_INFO"];
export function canTransition(
  status: string,
  action: "edit" | "submit" | "reopen" | "accept",
) {
  if (action === "edit" || action === "submit")
    return editable.includes(status);
  if (action === "reopen") return ["OFFERED", "REJECTED"].includes(status);
  return status === "OFFERED";
}
