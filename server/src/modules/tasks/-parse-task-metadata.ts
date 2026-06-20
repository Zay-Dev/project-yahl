export const parseTaskMetadata = (yahl: string) => {
  const nameMatch = yahl.match(/^name:\s*(.+)$/m);
  const descriptionMatch = yahl.match(/^description:\s*(.+)$/m);

  return {
    description: descriptionMatch?.[1]?.trim() ?? '',
    name: nameMatch?.[1]?.trim() ?? '',
  };
};
