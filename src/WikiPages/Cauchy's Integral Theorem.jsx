import React from "react";
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
import Linker from "../Components/Linker";
import './Styles.css'

const CauchysIntegralTheorem = () => {
  return (
    <div className="OuterContainer">
      <h2>Cauchy's Integral Theorem</h2>
      <div className="Container">
      <Latex>
        {`$$\\oint_C\\frac{g(z)}{z-z_0}dz=2i\\pi g(z_0)$$. 
        Proof: $$\\oint_C\\frac{g(z)}{z-z_0}dz$$`}
      </Latex>
      <div className="InlineContent">
      <Linker name='Homotopy'/>
      <Latex>
        {` allows for change of contour as $$=\\oint_{C_\\epsilon}\\frac{g(z)}{z-z_0}dz$$. Where $C_\\epsilon$ describes a smaller region, epsilon ball. Redefining the integral with $z=z_0 + \\epsilon e^{i\\theta}$. $z_0$ is the displacement of the epsilon ball defined by the second term. by taking the [[Jacobian]],  $i\\epsilon e^{i\\theta}$. The change in theta and z are related by $dz = i\\epsilon e^{i\\theta}d\\theta$. The integral is now $$=i\\int_0^{2\\pi}g(z)d \\theta$$.$g(z_0+\\epsilon e^{i\\theta})=g(z_0+\\epsilon (1+i))= g(z_0)+\\epsilon(1+i)\\partial_\\theta g(\\theta)$ changes the above integral to $$=\\lim_{\\epsilon\\to0} \\left[ i\\int_0^{2\\pi}(g(z_0)+\\epsilon\\partial_\\theta\\Theta)d\\theta \\right]$$ where, $\\Theta = (1+i)g(\\theta)$. Evaluating the integral $$=\\lim_{\\epsilon\\to0} \\left[2i\\pi(g(z_0)+\\epsilon\\partial_\\theta\\Theta) \\right]$$. Taking the limit when $\\epsilon \\to 0$, $$=2i\\pi g(z_0) $$, QED.`}
      </Latex>
      </div>
      </div>
    </div>
  );
};

export default CauchysIntegralTheorem;
