# lib_dynamiccaching: Storefront Reference Architecture (SFRA)

This is the repository for the lib_dynamiccaching plugin. This plugin adds dynamic page caching, including
the following capabilities:

* Dynamic stock based cache timings, based on Active Data

# Cartridge Path Considerations

The lib_dynamiccaching plugin requires the app_storefront_base cartridge. In your cartridge path, include the cartridges in
the following order:

```
plugin_dynamiccaching:lib_dynamiccaching:app_storefront_base
```

# Getting Started

1. Clone this repository. (The name of the top-level folder is lib_dynamiccaching.)
2. In the top-level plugin_gtm folder, enter the following command: `npm install`. (This command installs all of the
   package dependencies required for this plugin.)
3. In the top-level lib_dynamiccaching folder, enter the following command: `npm run uploadCartridge`

For information on Getting Started with SFRA,
see [Get Started with SFRA](https://documentation.b2c.commercecloud.salesforce.com/DOC1/index.jsp?topic=%2Fcom.demandware.dochelp%2Fcontent%2Fb2c_commerce%2Ftopics%2Fsfra%2Fb2c_sfra_setup.html)
.

# Release management

# NPM scripts

Use the provided NPM scripts to compile and upload changes to your sandbox.

## Linting your code

`npm run lint` - Execute linting for all JavaScript and SCSS files in the project.

## Watching for changes and uploading

`npm run watch` - Watches everything and recompiles (if necessary) and uploads to the sandbox. Requires a valid dw.json
file at the root that is configured for the sandbox to upload.