/** An HTML file imported as its text (tsup's `text` loader): dev's page. */
declare module "*.html" {
  const text: string;
  export default text;
}
