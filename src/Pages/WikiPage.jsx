import React from 'react';
import { useLocation } from 'react-router-dom';
import {wikiPagesComponents} from '../WikiPages/WikiPagesComponents';

function WikiPage() {
  const location = useLocation();
  const name = new URLSearchParams(location.search).get("name");
    console.log("WikiPage.jsx");
    console.log(name);
  // Use the "name" parameter in your component
  // ...
  const Component = wikiPagesComponents[name];
  return (
    // Your component JSX
    <div>
      <h1>WikiPage</h1>
      <Component />
    </div>
  );
}

export default WikiPage;
