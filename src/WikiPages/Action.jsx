import React from "react";
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
import Linker from "../Components/Linker";
  

const Action = () => {
    return (
        <div className="OuterContainer">
          <h2>Action</h2>
          <div className="Container">
          <div className="InlineContent">
          <Linker name="Configuration Space"/> <Latex>{` (Imagine a `}</Latex> <Linker name="Manifold"/> <Latex>{` of dimension N and the elements as `}</Latex> <Linker name="Generalized Coordinates"/> <Latex>{`, $\\{q_i\\}$, where $i$ goes from 1 to N) is used to define the `}</Latex> <Linker name="Lagrangian"/> <Latex>{` as a function of the `}</Latex> <Linker name="Generalized Coordinates"/> <Latex>{` and its velocity, $\\mathcal{L}(q_i,\\dot{q}_i)$. Consider a parameterization of $q_i$ such that it is parameterized with time, $q_i(t)$. Now the `}</Latex> <Linker name="Lagrangian"/> <Latex>{` is $\\mathcal{L}(q_i(t),\\dot{q}_i(t))$. The action is an integral of the `}</Latex> <Linker name="Lagrangian"/> <Latex>{` with respect to the parameterized variable, $$S = \\int \\mathcal{L}(q_i(t),\\dot{q}_i(t))\\hspace{0.2em} dt$$. This form is the indefinite form, but when one sets boundaries then it will produce a number. The number is a measure of the "Action". A key principle in physics is that the process happens in such a way to extremize the action (`}</Latex> <Linker name="Hamilton's Principle"/> <Latex>{`). The minima are assumed, and not the maxima. The consequence of `}</Latex> <Linker name="Hamilton's Principle"/> <Latex>{` is the mathematical statement, $$\\delta S = 0$$. The delta in front of the $S$ is the `}</Latex> <Linker name="Variation"/> <Latex>{`. The `}</Latex> <Linker name="Variation"/> <Latex>{` of the action is the small transformation to S, $$S' = S + \\delta S $$. $S' = \\int \\mathcal{L}(q+\\delta q, \\dot{q}+\\delta \\dot{q})\\, dt$. $$\\mathcal{L}'(q,\\dot{q})= \\mathcal{L}(q,\\dot{q}) + \\delta\\mathcal{L}(q,\\dot{q})$$ $$\\delta \\mathcal{L}(q,\\dot{q}) = \\mathcal{L}'(q,\\dot{q}) - \\mathcal{L}(q,\\dot{q})$$$$\\delta \\mathcal{L}(q,\\dot{q}) = \\mathcal{L}(q+\\delta q,\\dot{q}+\\delta \\dot{q}) - \\mathcal{L}(q,\\dot{q})$$ Why can we set $\\mathcal{L}'(q,\\dot{q})$ to $\\mathcal{L}(q+\\delta q,\\dot{q}+\\delta \\dot{q})$? `}</Latex>
          </div>
          </div>
        </div>
      );
    };

export default Action;
