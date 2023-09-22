import React, {useState} from "react";
import { Link, useLocation } from "react-router-dom";
import {fileNamesWiki} from "../WikiPages/WikiPagesComponents";
import ObsidianToReactConverter from "../Components/ObsidianToReactConverter";

export default function Materials() {
    const obsidianInput = `hi`;
    // Configuration space is of space M where M is some [[Manifold]]. The configuration space have elements in M denoted, $$\\{q_i\\}\\in M \\subset\\mathbb{R}^N, \\hspace{1em} 1\\leq i \\leq N$$. $q_{i}$ are [[Generalized Coordinates]]. Manifold, M, is of dimension N. 
    // $\\dot{q}_i = \\frac{dq_i}{dt}$ is generalized velocity. The configuration space is used to define the [[Action]].
    // `;
    function Contents() {
        return (
            <>
            <h2>Contents</h2>
            <ul>
                {fileNamesWiki.map((name) => (
                    <Link
                    to={{
                      pathname: "/WikiPage",
                    //   search: `?name=${encodeURIComponent(name.replace(/['\s]/g, ''))}`,
                      search: `?name=${encodeURIComponent(name)}`,
                    }}
                    className="nav-link"
                    key={name}
                  >
                  {name}
                </Link>
                ))}
            </ul>
            </>
        );
    }
    return (
        <>
        <div className="container">
            <div className="row">
            <div className="col-md-12">
                <h1>Materials</h1>
                <p>
                The materials page is organised in the style of a wiki page. I organised the materials into ideas such that it can easily be understood one at a time. If there are any unfamiliar definitions or ideas I usually have them clickable, which takes you to the relevant page.

                This page is under construction. Please check back later for more
                updates.
                </p>
            </div>
            {/* <Example /> */}
            </div>
            <div className="row">
                <div className="col-md-12">
                    <Contents/>
                    <ObsidianToReactConverter obsidianInput={obsidianInput}/>
                </div>
            </div>
        </div>
        </>
    );
}