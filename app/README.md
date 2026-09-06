# app/

Aplicação Web de página única (SDD §2.1-C, ADR-003/004). React 18 + Vite,
`react-router-dom`, CSS Modules com tokens. Dependências de runtime autorizadas:
`react`, `react-dom`, `react-router-dom`, `zod` (SDD §3).

Estrutura prevista: `app/rotas` (FUND-04), `app/dados` (`useSnapshot`, UI-DS-08),
`app/armazenamento` (`preferencias`/`cenario`, UI-DS-09), `app/ui` (uma pasta por
tela do UX-SPEC + `ui/componentes`, design system), `app/telemetria` (TEL-01).
Este arquivo só documenta a estrutura criada em FUND-01; conteúdo real entra a
partir de FUND-04.
