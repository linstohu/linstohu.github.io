// Existing monthly notes and the Markdown below their frontmatter share one rendering pipeline.
export default function remarkSnapshotNotes() {
  return (tree, file) => {
    if (!/(?:^|[\\/])content[\\/]now$/.test(file.dirname ?? '')) return;
    const notes = file.data.astro?.frontmatter?.notes;
    if (!Array.isArray(notes)) return;
    const sections = notes.map(({ title, text }) => ({
      type: 'snapshotNote',
      data: { hName: 'section', hProperties: { className: ['snapshot-note'] } },
      children: [
        {
          type: 'heading',
          depth: 3,
          children: [{ type: 'text', value: title }],
        },
        {
          type: 'snapshotNoteBody',
          data: {
            hName: 'div',
            hProperties: { className: ['snapshot-note-body'] },
          },
          children: this.parse(text).children,
        },
      ],
    }));
    tree.children.unshift(...sections);
  };
}
