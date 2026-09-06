declare module '*.module.css' {
  const classes: { readonly [nomeDaClasse: string]: string };
  export default classes;
}
