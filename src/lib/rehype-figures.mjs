// Wrap images after Astro has collected their paths, retaining its native asset pipeline.
export default function rehypeFigures() {
  return (tree) => {
    function walk(node) {
      for (const child of node.children || []) {
        if (
          child.type === 'element' &&
          child.tagName === 'p' &&
          child.children?.length === 1 &&
          child.children[0].tagName === 'img'
        ) {
          const image = child.children[0];
          const caption = image.properties.title;
          image.properties.loading ||= 'lazy';
          delete image.properties.title;
          child.tagName = 'figure';
          child.properties = { className: ['article-figure'] };
          child.children = [
            {
              type: 'element',
              tagName: 'button',
              properties: {
                type: 'button',
                className: ['image-open'],
                ariaLabel: `放大查看：${image.properties.alt || '配图'}`,
              },
              children: [image],
            },
          ];
          if (caption)
            child.children.push({
              type: 'element',
              tagName: 'figcaption',
              properties: {},
              children: [{ type: 'text', value: String(caption) }],
            });
        } else walk(child);
      }
    }
    walk(tree);
  };
}
