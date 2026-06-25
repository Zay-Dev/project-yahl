export const parseTaskMetadata = (yahl: string) => {
  const nameMatch = yahl.match(/^name:\s*(.+)$/m);
  const descriptionMatch = yahl.match(/^description:\s*(.+)$/m);
  const backgroundMatch = yahl.match(/^background:\s*(true|false)\s*$/m);

  return {
    background: backgroundMatch?.[1] === 'true',
    description: descriptionMatch?.[1]?.trim() ?? '',
    name: nameMatch?.[1]?.trim() ?? '',
  };
};
