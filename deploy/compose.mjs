#!/usr/bin/env node
// Operator CLI: use the dedicated project and exact deployed immutable images.
import {compose} from './config.mjs';
if(process.argv.length<3)throw new Error('Usage: node deploy/compose.mjs COMPOSE_ARGUMENTS...');
compose(process.argv.slice(2),{deployed:true});
