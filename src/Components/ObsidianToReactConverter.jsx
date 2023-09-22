import React from 'react';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
import Linker from './Linker';

function ObsidianToReactConverter({ obsidianInput }) {
  // Replace [[...]] with Latex and Linker components
  const convertedText = obsidianInput
      .replace(/^(?!\[\[)/, '<Latex>{`')
      .replace(/(?<!\]\])$/, '`}</Latex>\n')
      .replace(/([^[])\[\[/g, '$1`}</Latex>\n\[\[') 
      .replace(/\]\]([^[])/g, '\]\]<Latex>{`$1')
      .replace(/\[\[(.*?)\]\]/g, '<Linker name="$1"/>\n')
      .replace(/\\/g, '\\\\'); // Replace \ with \\
  // Wrap the entire text in <Latex> tags
  return (
    <div>
      {convertedText}
    </div>
  );
}

export default ObsidianToReactConverter;
