export interface File {
  chunks?: Array<{
    content: string;
    changes: Array<{
      type: string;
      content: string;
    }>;
  }>;
  from?: string;
  to?: string;
}

const parseDiff = jest.fn((_diff: string): File[] => {
  return [
    {
      chunks: [
        {
          content: 'mock chunk',
          changes: [
            { type: 'add', content: '+ added line' },
            { type: 'del', content: '- deleted line' },
          ],
        },
      ],
      from: 'file1.txt',
      to: 'file1.txt',
    },
  ];
});

export default parseDiff;
