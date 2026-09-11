#!/usr/bin/env node
/**
 * The Holding · public-site polish coordinator
 *
 * Importing this module is intentionally side-effect free. Presentation is
 * materialized only when this entrypoint is executed directly, or when an
 * explicit caller invokes materializePublicSitePolish(). This prevents capital
 * projectors from accidentally mutating presentation merely by importing a
 * dependency.
 *
 * No capital/accounting/reward/index semantics. executionAuthority = none.
 */

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SELF=fileURLToPath(import.meta.url);

export async function materializePublicSitePolish(){
  await import('./public-site-polish-materializer.mjs');
}

const invoked=process.argv[1] ? path.resolve(process.argv[1]) : '';
if(invoked===SELF){
  await materializePublicSitePolish();
}
