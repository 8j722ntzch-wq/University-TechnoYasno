import {rolldown} from 'rolldown';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const dir=await mkdtemp(join(tmpdir(),'technoyasno-tests-'));
try{
  const bundle=await rolldown({input:'tests/store.mjs',platform:'node'});
  const file=join(dir,'store.mjs');
  await bundle.write({file,format:'esm'});
  await bundle.close();
  process.exitCode=spawnSync(process.execPath,['--test',file],{stdio:'inherit'}).status??1;
}finally{await rm(dir,{recursive:true,force:true})}
