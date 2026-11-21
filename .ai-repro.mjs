import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push('PAGEERROR ' + e.stack)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
await p.goto('http://localhost:5179/login'); await p.getByLabel('Email').fill('learner@profjero.test'); await p.getByRole('textbox',{name:'Password'}).fill('DevPassw0rd!'); await p.getByRole('button',{name:'Log in'}).click();
await p.waitForTimeout(5000); console.log('URL', p.url());
await p.goto('http://localhost:5179/ai'); await p.waitForTimeout(5000);
console.log((await p.locator('body').innerText()).slice(0,3000)); console.log(errs.slice(0,4).join('\n----\n').slice(0,4000)); await b.close();
