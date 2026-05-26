#!/usr/bin/env node
// One-shot fetch of images I previously scraped from the Dalton Google Sites
// portfolio. Only covers categories not already populated from the Drive
// download. Saves to public/art/<year>/<slug>/<N>.jpg at original resolution.
//
// Run once: node scripts/fetch-art-from-google.mjs
// Then run optimize-art.mjs to compress.

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const ART = join(ROOT, '..', 'public', 'art');

// Convert sitesv URLs to original size by swapping `=w1280` (or any size param) for `=s0`.
const toOriginal = (url) => url.replace(/=w\d+(-h\d+)?(-c)?$/, '=s0');

const TARGETS = {
  '2017-2018/past-present-future': [
    'https://lh3.googleusercontent.com/sitesv/AA5AbUAy4nzk-nhbjKdQfhjqxrUtEuhK5U046-hoaW4XKdq_JJUshT1dMiJEjGtij5RUHi7-vQuKz2w-hKRybC8_GXZ6zXQtVmiW_efNcT_SMuhjuIFxfitudYnFES3ibiDGkB_2yh4TVw6h0THxJbDuhzgPibiynOj3xQS08871gx3Q6ZvN8AiJLG55ZqtBv7VfWQ=w1280',
  ],
  '2018-2019/pencil': [
    'https://lh3.googleusercontent.com/sitesv/AA5AbUAcCZVHpP3P3iGvCyet_BykfJdYHRG0iFR9gex2B8N6Yx7NgOYOpT588vJATSHzWGD-9H8RmSibwPZliMljGfdY1YVj1Gkzakv6pQOLJqHWCPyvXXk8VwKZBGU6nnEIx7DDfLZUjUfZVG0uCnjwS99f2ZxwcGwk-88i2NTRrarCnAmozLel2EV3yG4RGRvMHhyE8g=w1280',
    'https://lh3.googleusercontent.com/sitesv/AA5AbUAkr2PzwdYmcZT0CStiiQWXjoXbH9mQ4M8S2hKlNd5Xf52bqX0s6PTuij1o1m9Etd2E5MbuZomOic0pfvsBuH-zOrDpp4wG7HQXldDvnJaz2g6TtHQLjI7UAkKk1e14TVtMNCyMLfyYcDUhH7UOdn9jzb_I2ypeN4Wq3LaHMpEZ6haYq3XrTRu_4t25qYZa-WphYQ=w1280',
    'https://lh3.googleusercontent.com/sitesv/AA5AbUCG3AMMj2MjYIbt1CQ6MPYl1DWvB_MhVWcmzh4MieRgLuJEBsnmzie1ORBPBLS-9ARdKHwtQQfILeGfEuXukGUfv94D8IXDQVnMs2R0MJerp0pT9gdfp-79hT2XfslSa5ls6W6iyp7TDg657fVXbdxupHSMhE6GhXxBGJXWipiGZSx1e1_kV2y4mhNpI2ssaqGTWuAa=w1280',
  ],
  '2018-2019/self-portrait': [
    'https://lh3.googleusercontent.com/sitesv/AA5AbUBD7nt7cEiUNTNitEGnMarudEP_-dNyRGXUslSAbQu9Xt7hRuGZasx_X7M_BfAjeXhwwxVDcR_RJoifaex2nKwx-MOu1MVtIgtexCL2d5MyG8jwTUyWUJMldeBxRWRcnC-dVQUDKHc3VkdkQmezW1SqDWg2j_-2qlFHXjOw4zJcRef8IE_J-vzZFE9SY-kTUTsWKA=w1280',
  ],
  '2018-2019/meaning': [
    'https://lh3.googleusercontent.com/sitesv/AA5AbUA_6eGgye2RKVIRa09SctWCy0Yg5w0Osbd7VN4rLdU90-9w9LJtEkjwVQar3jne4wKVzLiiRB_-qNEmtlfcnDfZoltZC-qJ135Za4d5I_1HqaeWs4PSkO-ETTDbzJU8Bku4iVudG5L0-aXcJboS0H1zCuVDZ2xHjaA8flfrzXBlbNLJLS_Vxdz304vKnZo5yvdnqzts=w1280',
  ],
  '2018-2019/marker-and-pen': [
    'https://lh3.googleusercontent.com/sitesv/AA5AbUBKqb5J5CBVmqh23sj8UZcv-KBRlhOoLN-DNhr40nxn3TvBW_cYZblOg9n7Jb3ZUFNf2wRa6GgI73f6EEdDZTI3Aptdjwlua43ubt60SwIZz34I-rB7IKufdU_mbnyqoQIqGyNpy8qEMd7JeUC4iM6nhQfqPhWz9gK-_l1EKVejFtnJGIAGxdEk_FFYDXgZDtXzOWaj=w1280',
  ],
  '2018-2019/human-progress': [
    'https://lh3.googleusercontent.com/sitesv/AA5AbUC8HqXrfcp8BUTOl8PRtn0jSD3PcteRw0aejP_idooVOjRnpu0y0F3MHm2-Oa9XvUE4AoqmNpxEJvE7WJvW_O9S1IYGMw0huSjAHFVMCRkJEur7gxK17MSwuintwExEE5JXl5FMeMJPGCxR1Lr4iQfxNubmB7JeU0V7dNO8CyjaBOb6YPBzypERNHPh-cd9PR0bQnGs=w1280',
    'https://lh3.googleusercontent.com/sitesv/AA5AbUDMLMi38qxcAfA17H0D11adlw9LtFaodiA8yFZRL47rQidQ-LCvC9ZLxV3a28guJIT8yoOdg5jdpPqY8pYYNcadt_rh-SQcKVBjHqhzEpctLj3xP93QOLfI6IdFsQw76xFtHfaztKH52Jzib6Zcf287eWiusT5dKRsfriY-InWrkJ5nNYi0rNCXuXvq-7YhMEWvRJ08=w1280',
    'https://lh3.googleusercontent.com/sitesv/AA5AbUD8gMXNeo_bp-Ih3BKtLYUHiM1Ih8haFMjSQbRRAIuNXQXFX_62vaxh46LSX78xVlLFu836raIxJbriwy3_5ZmmMrHotpJBgws2mhiVeAYnwaZPbKeaX8b3Y6zhvwE0AAYEU-ank_zQ_SSotkyLXDC8WaCNC-96PrcjQq0wsXMCI7qqucdX5HDkEN7be7xSEwZ_gg=w1280',
    'https://lh3.googleusercontent.com/sitesv/AA5AbUDmmsQA5iUl55iCh8-s4jPBvjlzRtbyeHRUCHZDePm6PSTNTSAEQG5CGpKjesGrXpATtSkkUjLLXpxsdiTtNwCvb4qJfI5LPT157zktG8ybqROlnK67sJdzaqQZY5nMXrljy6nQ40h6LMuyR6-nWcbwrpjhD36po2VgCUssgVZwt_KZjdDEMRBHX-sjK6ob_aHWqCBr=w1280',
    'https://lh3.googleusercontent.com/sitesv/AA5AbUAM9tUGHb1w0ODt2Z2r_Kia_bN0ZvDZWiyU2p0F-Iw0ZQy0bwgAXzDNLnMgTXV3p0NgAty-uKUM_QBTvO6htivo5FH2GlKOUVUKJbtbukYPur_lWIsj_vFqkLmJwTYzC9MhU3K3HZG_WdJeTx8VcMWqcgFE60cPNnVMBucQGCS7T8Huq77sgjJXewKI-alJ0u_nOg=w1280',
    'https://lh3.googleusercontent.com/sitesv/AA5AbUBZAxS4-OoSNAw3a72slWJuFHqtYv83irvaJboQagRoCluYcxjLsLLhrK1lLL7_RG9CL5Zt8nMbMjoUiwho0DodNVIcD4aw9We--5F_dWdLf5ZzNttuoMPU9DCvwwoxKkHxGpVbvTS-buVURKE1DdBXmsPkKdVytGhsmMDlKvkbClREA53MRhTUXsmoEaTi-ixD7hWs=w1280',
    'https://lh3.googleusercontent.com/sitesv/AA5AbUDXcWS871TYFI6-xuaNo4MJ2hHt1zcS4WEhCM4hpAS2Vw23e-ydOJ_DzbuAJeLXZ_IdcDW5gbGoYLoteoDTaYeNh5JeLY5OLRzs0xgpqMNkZk0ST5KU2q1sVcg3EJ8sAlhXw2u7RPUPFa1HZDvoGbQ-LrcuT0i8J-d93x9x5ilmZXvxGD0jaPgbaIJj6P1SLcYCCAtI=w1280',
    'https://lh3.googleusercontent.com/sitesv/AA5AbUBfkW54xsYvLHqlq5fMVwVceUIF0-XsluBxnbwZHij0hFZEMKmBXgfSlykzYpyI3P6hU5N4LFYIcsIb2TZNh26Ox0PxAMJf2yLyFauc5_QZmfLUYSZITtlPocgO73xpNQcx2Sm15lBjWkVhURqNMk9Xog8R1TiviWgXaEaHj-bCU-ztKWoNyhp3JN9roWpJ4GzvMFDB=w1280',
    'https://lh3.googleusercontent.com/sitesv/AA5AbUCF56qSV_i4x9Dt1s_9OG1SQxuZP6nkHt2weXml3Zwfe3qt8DZWiEFXd4OO5kilcCQhKP_zDvfoOGFNusYmLQqHb1ShOxpmN8y_OV2iyeDW4y2S5K9tBFU90volLROL6-QcNv0zCT2nq2bjPwWS0Dt3CBJu65zmQgfCYe7w_p-NxeaTQUD_v0OmEYpP4LFyfeHVE37r=w1280',
    'https://lh3.googleusercontent.com/sitesv/AA5AbUCdqdL9QjbjeU57uemNkjHuJBHQM4xme5T4xcZDvrllKITyDTQXIHrFACb6fX0aSRbuNi7FWq0SYDVaD5w-HV_6vdvFnZfDCGPzXy_x8E-jQR0tJss2BamE4GbNPz8Cb4Fghqubyq0_6k0ABUUNmx-aZ03jOCPJj9U9lYAQYYrMiHCkmH3c3gYrVRbelHCoA9ivnA=w1280',
    'https://lh3.googleusercontent.com/sitesv/AA5AbUAwAd8ujj9d9VAxg8iOVWTPXLpzQRyB2jvBMjUHfDVpGCjKi0LpF_XGkUQcYt7oW6bchTmQMEv2B66m575iFur4PV5dlxGJhWu90jBdXLkffwjLJG4NKwbpr_rzGM3fgvybx17TZmViQ3AvH5WYDLYOqFfMWod780UKNoTnX5UcAWn6OvD2QuCR3z5tNOY4yKOaCw=w1280',
    'https://lh3.googleusercontent.com/sitesv/AA5AbUCUYMU3JM5qAEVxfdUEbTPO8kwvBtxg_k6li9_pNpOuzvj0lRCRoA4q2LehoAlwQnDHItEIB2sKiCU9bnH60Hy3dGLGpSGa6iEHs31iqJcxtQ09ZILXEDj4qAD5iw5TMM6vjYDw6Md95BTCuH85hA7uZ2ONf_hjlRk28CN2ZoHHJaivBp01d-bQvz70dTH1n9LKQQ=w1280',
  ],
  '2018-2019/figure-drawings': [
    'https://lh3.googleusercontent.com/sitesv/AA5AbUBtI0sh6aMqOU_X4vaf3Pky1OAS4dhq8HaGAmpZU3_kKi5vGpGDlsnxDWWMmJziimQIYLh_OfLLjCfypY82fxET7QU9zsZkRHFquML3ppYaee3yX_P4HuO-E0q6dTs0dFQjtWDQV8mjddnCPacy08W1Ysn5PgbwXxtUFwBJUYat8EyBRlAnDXhqN501pPTbzWNc9w=w1280',
    'https://lh3.googleusercontent.com/sitesv/AA5AbUAKfskT6Z60jXZ9uDA6AHOvp9EdHAzJPTxHabajtZc6z7RgoXD-Q7uTdFK-ukq0BsNqp-jhErpcM44QQXMVxjwNYwwlbjmDCrWqcsRsOTFHpfIcd60QehcZ8gVLlTUC2LQ7mBu-1muQaO_pOIXTWcntifQkz7Ruddp4CM35YI6IWztS9UbFP4bXS-4apiFWmPh9WEkL=w1280',
  ],
};

let totalDl = 0;
for (const [path, urls] of Object.entries(TARGETS)) {
  const dir = join(ART, path);
  await mkdir(dir, { recursive: true });
  let i = 1;
  for (const url of urls) {
    // try original size first; fall back to the as-scraped =w1280 if rejected
    const candidates = [toOriginal(url), url.replace(/=w\d+(-h\d+)?(-c)?$/, '=w2400'), url];
    const out = join(dir, `${i}.jpg`);
    process.stdout.write(`  ${path}/${i}.jpg `);
    let r;
    for (const u of candidates) {
      r = await fetch(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
          'Referer': 'https://sites.google.com/',
          'Accept': 'image/avif,image/webp,image/png,image/*;q=0.8',
        },
      });
      if (r.ok) break;
    }
    if (!r.ok) {
      console.log(`FAIL ${r.status}`);
      i++;
      continue;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    await writeFile(out, buf);
    console.log(`${(buf.length / 1024) | 0} KB`);
    totalDl += buf.length;
    i++;
  }
}
console.log(`\nTotal: ${(totalDl / 1024 / 1024).toFixed(1)} MB downloaded`);
