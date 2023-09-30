// Import JSON Schema Faker and fs modules
const jsf = require('json-schema-faker');
const fs = require('fs');

// Read the asyncapi spec file as a JSON object
const specFile = process.argv[2]; // Get the filename from command line argument
const outputFile = process.argv[3]; // Get the filename from command line argument
const spec = JSON.parse(fs.readFileSync(specFile));

// Get the schema object from the spec
const schema = spec.components.schemas;

// Generate sample data from the schema using JSON Schema Faker
const sampleData = jsf.generate(schema);

// Print or save the sample data as you wish
console.log(sampleData);

// Write the output to a JSON file
fs.writeFileSync(outputFile, JSON.stringify(sampleData, null, 2));