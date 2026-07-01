export const audit = {
  append: async (_args: {
    leaveRequestId: string
    actorId: string
    action: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
    comment?: string
  }): Promise<void> => {},
}
