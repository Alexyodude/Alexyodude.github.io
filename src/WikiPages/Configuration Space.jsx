import React from "react";
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
import Linker from "../Components/Linker";
import './Styles.css'
  

const Action = () => {
    return (
        <div className="OuterContainer">
          <h2>Configuration Space</h2>
          <div className="Container">
          <div className="InlineContent">
          </div>
          <div className="InlineContent">
          <Latex>{` Configuration space is of space M where M is some `}</Latex> <Linker name="Manifold"/> <Latex>{`. The configuration space have elements in M denoted, $$\\{q_i\\}\\in M \\subset\\mathbb{R}^N, \\hspace{1em} 1\\leq i \\leq N$$. $q_{i}$ are `}</Latex> <Linker name="Generalized Coordinates"/> <Latex>{`. Manifold, M, is of dimension N. $\\dot{q}_i = \\frac{dq_i}{dt}$ is generalized velocity. The configuration space is used to define the `}</Latex> <Linker name="Action"/> <Latex>{`. `}</Latex>
          {/* <ObsidianToReactConverter obsidianInput={obsidianInput} /> */}
          </div>
          </div>
        </div>
      );
    };

export default Action;
