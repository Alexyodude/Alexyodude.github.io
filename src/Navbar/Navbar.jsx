import React from 'react';
import { Link } from "react-router-dom";
import './Navbar.css';

export default function Navbar() {
    return(
        <>
        <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
            <div className="left-nav">
            <Link to="/" className="navbar-brand">
                <img src="favicon.ico" alt="logo" id="logo"/>
                Home
            </Link>
            {/* <ul className="navbar-nav">
                    <Link to="/Form" className="nav-link">Form</Link>
            </ul>  */}
            </div>
            <div className="right-nav">
                <ul className='navbar-nav'>
                <Link to={{
                      pathname: "/Materials",
                    }}
                    className="nav-link"
                  >
                   Materials </Link>
                </ul>
                <ul className="navbar-nav">
                    <Link to={{
                      pathname: "/About-Me",
                    }}
                    className="nav-link"
                  >
                    About Me</Link>
                </ul>
            
                {/* <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNavDropdown" aria-controls="navbarNavDropdown" aria-expanded="false" aria-label="Toggle navigation">
                    <span className="navbar-toggler-icon"></span>
                </button> */}
            </div>
            {/* <div className="collapse navbar-collapse" id="navbarNavDropdown"> 
            </div> */}
        </nav>
        </>
    )
}