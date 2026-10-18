import {SiteProvider} from './SiteContext';
import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './styles.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><SiteProvider><App/></SiteProvider></React.StrictMode>);

import './redesign.css';

import './workshop.css';

import './admin.css';

import './refinements.css';

import "./experience-v5.css";

import "./koala-ai.css";
