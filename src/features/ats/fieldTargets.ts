/**
 * Pemetaan isu → id field di form (T7.4). Konvensi id mengikuti editor Fase 3:
 * `skill-group-<groupId>-items`, `profile-email`, dan seterusnya.
 */
export const firstSkillGroupFieldId = (
  sections: readonly { kind: string; data: unknown }[],
): string => {
  const skills = sections.find((section) => section.kind === 'skills')
  if (!skills) return ''
  const groups = (skills.data as { groups?: { id: string }[] }).groups ?? []
  return groups[0] ? `skill-group-${groups[0].id}-items` : ''
}
