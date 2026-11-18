import sax from 'sax';

export function audioItems(xml) {
  const items = [];
  const parser = sax.parser(true);
  let item,
    inGuid = false;
  parser.onopentag = ({ name, attributes }) => {
    if (name === 'item') {
      item = { guid: '', enclosures: [] };
      items.push(item);
    }
    if (!item) return;
    if (name === 'guid') {
      inGuid = true;
      item.isPermaLink = attributes.isPermaLink;
    }
    if (name === 'enclosure') item.enclosures.push(attributes);
  };
  parser.ontext = parser.oncdata = (text) => {
    if (inGuid) item.guid += text;
  };
  parser.onclosetag = (name) => {
    if (name === 'guid') inGuid = false;
    if (name === 'item') item = undefined;
  };
  parser.write(xml).close();
  return items;
}
