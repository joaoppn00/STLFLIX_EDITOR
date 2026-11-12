# Plano de cenas — VSL-2198 · corpo

Modelo: stlflix-cenas (identidade das VSLs + cenas novas do catálogo HyperFrames). M02, M07 e M11 aprovadas no teste de 12/11.

## Bloco 01 · Abertura

- **M01** · Os 4 produtos garantidos (checklist) — "Você acabou de garantir o Vivendo"
  duração: 11
  > 0.2 | kicker: VOCÊ ACABOU DE GARANTIR | json: {"k":"checklist","d":0.15,"items":[{"t":"Vivendo de Impressão 3D","d":1.63},{"t":"Impressão Sem Medo","d":3.57},{"t":"STLFLIX","d":4.93},{"t":"STLSeller","d":6.19}],"selo":{"t":"Vitalício","d":7.65}}

- **M02** · Acesso garantido (notificação) — "E o seu acesso já está garantido"
  duração: 4.4
  > 0.25 | json: {"k":"notif","app":"STLFLIX","quando":"agora","titulo":"Acesso **garantido**","corpo":"Black November · vitalício","check":1.5}

## Bloco 02 · A oportunidade

- **M03** · Caminho do marketplace + 2 ferramentas — "Você garantiu o caminho do Marketplace"
  duração: 11.4
  > 0.3 | kicker: VOCÊ GARANTIU | título: o caminho do **marketplace**
  > 6.6 | título: **+2** ferramentas | legenda: pra se diferenciar ainda mais

## Bloco 03 · Por quê · peças exclusivas

- **M04** · Disputando preço centavo por centavo — "quem vende o mesmo produto que todo mundo"
  duração: 6.2
  > 0.3 | kicker: TODO MUNDO VENDE O MESMO | json: {"k":"preco","d":0.15,"de":2990,"n":7,"dt":0.3,"ini":2.83} | legenda: centavo por centavo [atraso=4.6]

- **M05** · STLAI: peças que ninguém mais tem — "A STLA com acesso vitalício"
  duração: 8.7
  > 0.3 | kicker: ACESSO VITALÍCIO | título: **STLAI** | legenda: produtos personalizados a partir de 1 foto
  > 5.4 | kicker: PEÇAS QUE NINGUÉM MAIS TEM | chips: Shopee; Mercado Livre [passo=1.0, risca=1.3]

- **M06** · STLAcademy inteira (trilho) — "você pode levar também a STLA Academy"
  duração: 9.8
  > 0.3 | kicker: VOCÊ LEVA TAMBÉM | título: **STLAcademy** inteira
  > 3.5 | kicker: TODOS OS CURSOS DE IMPRESSÃO 3D | json: {"k":"trilho","d":0.15,"de":"Primeira peça","ate":"Modelagem **3D**","a":3.25,"b":4.85}

## Bloco 04 · As outras três formações de venda

- **M07** · As 3 formações de venda (lista) — "Você pode levar a Rota do Lojista"
  duração: 13.2
  > 0.2 | json: {"k":"lista","items":[{"ico":"casa-loja-fisica","t":"Rota do **Lojista**","s":"vender em quantidade pra lojas","d":1.44},{"ico":"casa-tiktok-social","t":"Venda **Viral**","s":"nas lives do TikTok Shop","d":4.88},{"ico":"casa-feira","t":"Feira 3D **Lucrativa**","s":"direto pro cliente nas feiras","d":8.44}]}

- **M08** · Venda física em paralelo — "eu nunca deixei de olhar para a venda física"
  duração: 6.4
  > 0.3 | kicker: EU NUNCA DEIXEI DE OLHAR | título: Venda **física** | legenda: em paralelo ao marketplace
  > 3.6 | kicker: PORQUE ELA TEM | chips: Margem maior; Sem comissão de plataforma [check, passo=1.3]

- **M09** · 1 produto, mais 3 caminhos (hub) — "o mesmo produto que você vende no Marketplace"
  duração: 9.9
  > 0.2 | json: {"k":"hub","d":0,"centro":{"ico":"casa-marketplace","t":"mesmo produto"},"items":[{"ico":"casa-loja-fisica","t":"Lojista","d":2.8},{"ico":"casa-tiktok-social","t":"Live","d":3.15},{"ico":"casa-feira","t":"Feira","d":3.5}]}
  > 4.75 | kicker: E VOCÊ FICA COM | título: todas as **plataformas** | legenda: e todas as formações de venda da STLFLIX

## Bloco 05 · Oferta

- **M10** · Complete o acesso: + R$ 1.997 (card) — "com a STLA, STL Academy inteira e as outras três formações"
  duração: 8.7
  > 0.3 | kicker: COMPLETE O SEU ACESSO COM | chips: STLAI; STLAcademy; 3 formações de venda [passo=1.3]
  > 6.7 | kicker: INVESTIMENTO ADICIONAL | json: {"k":"cartao","d":0.15,"texto":"+ R$ 1.997"}

## Bloco 06 · 2 mil reais de volta em filamento

- **M11** · R$ 2.000 de volta (contador) — "E o melhor, R$ 2.000 voltam para você"
  duração: 6.1
  > 0.1 | kicker: E O MELHOR | json: {"k":"dinheiro","de":0,"ate":2000,"pre":"R$ ","dur":1.3} | legenda: de volta em cupons de filamento [atraso=1.9]

- **M12** · Sai de graça — "Na prática, o seu acesso completo sai de graça"
  duração: 7
  > 0.3 | kicker: NA PRÁTICA | título: R$ 1.997 [risca=1.9]
  > 2.7 | título: **DE GRAÇA** | legenda: os R$ 2 mil voltam em filamento

## Bloco 07 · CTA

- **M13** · Complete a sua oferta (botão com toque) — "clica no botão aqui embaixo"
  duração: 7.4
  > 0.2 | título: Complete a sua **oferta** | json: {"k":"ctatoque","d":0.3,"text":"COMPLETAR MINHA OFERTA","toque":0.9}
