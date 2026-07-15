const WRITE_ACTIONS = ['CREATE_POLL', 'VOTE_ON_POLL', 'UPDATE_POLL'] as const;

export function getPollWriteAvailability(actions: string[], isUsingPublicNode: boolean) {
  const available = WRITE_ACTIONS.every((action) =>
    actions.some((candidate) => candidate.toUpperCase() === action));

  return {
    available,
    publicSigning: available && isUsingPublicNode,
  };
}
