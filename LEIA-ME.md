# Reserva de Salas | FEA Júnior USP

Site para reservar as salas da sede. A pessoa informa o nome, escolhe o dia, a sala e o horário. Se a sala estiver ocupada, o site mostra até que horas e por quem, e sugere reservar a partir do horário em que ela fica livre.

## Salas e regras

A planta e os nomes seguem o Caderno de Projeto de Design de Interiores (páginas 4 e 5):

| Sala | Quem pode reservar |
|---|---|
| Sala Azul | Todos |
| Sala Amarela | Todos |
| Sala de Estudos | Todos |
| Copa | Todos |
| Coworking | Só com a senha da diretoria |

- Cada reserva pode ter **no máximo 2 horas**.
- A **senha da diretoria** funciona como passe livre: sem limite de duração, reserva do Coworking, reuniões **semanais** (ex.: RD Estratégia), reservas até 400 dias à frente e cancelamento de qualquer reserva.
- Nem a diretoria consegue marcar duas reuniões na mesma sala no mesmo horário. Para liberar um horário ocupado, a diretoria cancela a reserva existente e depois marca a nova.

## Como funciona por dentro

- **Site** (pasta `public/`): páginas estáticas servidas pelo Netlify.
- **Servidor** (`netlify/functions/reservas.mjs` + `netlify/lib/core.mjs`): Netlify Function em `/api/reservas`. É o servidor que confere todas as regras (2 horas, Coworking, semanal, senha). Mexer no site pelo navegador não burla nenhuma delas.
- **Dados**: Netlify Blobs, o armazenamento do próprio Netlify. Um registro por dia com as reservas daquele dia, e um registro por série semanal.
- **Sem reserva dupla**: a gravação é condicional. Se duas pessoas reservarem a mesma sala no mesmo segundo, só a primeira consegue; a segunda recebe o nome de quem pegou.
- **Reuniões semanais**: ao marcar, o site mostra quantas reuniões serão criadas e quais datas já estão ocupadas. Dá para criar a série pulando essas datas. Se alguma gravação falhar no meio, as datas já gravadas daquela série são desfeitas.
- **Cancelar**: quem reservou cancela no aparelho em que fez a reserva (o site guarda uma chave secreta no navegador). A diretoria cancela qualquer reserva. Numa série, dá para cancelar uma data só ou a série inteira dali em diante.

## Publicar ou atualizar no Netlify

Se o site já está ligado ao repositório do GitHub, basta substituir os arquivos do repositório pelos desta pasta (Add file → Upload files, arrastando o conteúdo da pasta) e o Netlify publica sozinho.

Na primeira vez: Add new project → Import an existing project → GitHub → escolha o repositório → Deploy, com o build command e o base directory em branco.

## Variáveis de ambiente (Project configuration → Environment variables)

| Variável | Obrigatória? | Para que serve |
|---|---|---|
| `CODIGO_DIRETORIA` | **Sim**, para o Coworking e as reuniões semanais | A senha secreta da diretoria. Use uma frase longa, com letras e números. Quem não é da diretoria nunca vê essa senha: ela só existe no Netlify e no aparelho de quem a digitou. |
| `CODIGO_ACESSO` | Não | Código que todos digitam uma vez, junto com o nome, para quem receber o link de fora não conseguir usar. |

Depois de criar ou mudar uma variável, clique em **Deploys → Trigger deploy → Deploy site** para ela valer.

Para entrar como diretoria, clique em **Diretoria** no topo do site e digite a senha. Ela fica salva só naquele aparelho; clique de novo em Diretoria para sair. Se a senha vazar, troque o valor de `CODIGO_DIRETORIA` no Netlify e publique de novo: todos os aparelhos saem do modo diretoria.

## Mudar horários e limites

Tudo fica em `public/config.js`, usado tanto pelo site quanto pelo servidor:

- `HORA_INICIO`, `HORA_FIM`, `PASSO`: funcionamento das 7h às 22h, em blocos de 30 minutos.
- `MAX_MIN_SEM_DIRETORIA`: limite por reserva para quem não é diretoria (120 minutos).
- `DIAS_ANTECEDENCIA`: até quantos dias à frente qualquer pessoa reserva (60).
- `MAX_SEMANAS`: máximo de repetições de uma série semanal (53).
- `SALAS`: nomes, cores e `apenasDiretoria` de cada sala.

## Testar no computador antes de publicar

Precisa do Node.js 18 ou mais novo.

```bash
npm install
CODIGO_DIRETORIA=teste npm run local
```

Abra `http://localhost:8888`. Nesse modo as reservas ficam só na memória.

## Custos

O plano gratuito do Netlify funciona por créditos mensais com limite rígido; se acabarem, o site sai do ar até o mês seguinte. Cada publicação gasta créditos, então junte várias alterações antes de enviar ao GitHub. Acompanhe o consumo em **Usage & billing**.
