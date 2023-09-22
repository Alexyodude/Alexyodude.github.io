import React, {useState} from "react";
import { Link } from "react-router-dom";

export default function Linker({name}) {
    return (
        <Link
            to={{
              pathname: "/WikiPage",
            //   search: `?name=${encodeURIComponent(name.replace(/['\s]/g, ''))}`,
              search: `?name=${encodeURIComponent(name)}`,
            }}
          >
          {name}
        </Link>
    );
}