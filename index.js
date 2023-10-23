const fs = require('fs');
const yaml = require('js-yaml');
const faker = require('faker');
const solace = require('solclientjs').debug;

// Initialize Solace library
solace.SolclientFactory.init();

// Import MessageDeliveryModeType
const MessageDeliveryModeType = solace.MessageDeliveryModeType;

// Function to read an AsyncAPI spec from a file and parse it
function readAsyncAPISpec(filename) {
  try {
    const fileContent = fs.readFileSync(filename, 'utf8');
    return yaml.safeLoad(fileContent);
  } catch (error) {
    console.error(`Error reading or parsing the AsyncAPI spec: ${error.message}`);
    process.exit(1);
  }
}

// Function to extract schemas and associated topics from the AsyncAPI document
function extractSchemasAndTopics(asyncapi) {
  const schemas = {};
  const schemaToTopics = {};

  if (asyncapi.components && asyncapi.components.schemas) {
    const schemaNames = Object.keys(asyncapi.components.schemas);

    schemaNames.forEach((schemaName) => {
      schemas[schemaName] = asyncapi.components.schemas[schemaName];
      schemaToTopics[schemaName] = [];
    });
  }

  if (asyncapi.channels) {
    for (const channelName in asyncapi.channels) {
      const channel = asyncapi.channels[channelName];

      if (channel.subscribe && channel.subscribe.message && channel.subscribe.message.$ref) {
        const messageRef = channel.subscribe.message.$ref;
        const schemaName = messageRef.split('/').pop();

        if (schemaName in schemaToTopics) {
          schemaToTopics[schemaName].push(channelName);
        }
      }
    }
  }

  return { schemas, schemaToTopics };
}

// Function to generate fake data for a given schema
function generateFakeData(schema) {
  const fakeData = {};

  for (const propertyName in schema.properties) {
    const propertyType = schema.properties[propertyName].type;

    // Generate fake data based on the property type
    switch (propertyType) {
      case 'string':
        fakeData[propertyName] = faker.lorem.words();
        break;
      case 'number':
        fakeData[propertyName] = faker.random.number();
        break;
      case 'boolean':
        fakeData[propertyName] = faker.datatype.boolean();
        break;
      // Add more cases for other data types as needed
      default:
        fakeData[propertyName] = null; // Set to null for unsupported data types
    }
  }

  return fakeData;
}

// Function to publish data to a Solace topic with replaced variables
function publishToSolaceWithRandomVariables(topic, message) {
  const solaceMessage = solace.SolclientFactory.createMessage();

  // Replace variables in the topic with random values
  const replacedTopic = replaceTopicVariables(topic);

  // Create a Solace topic object
  const solaceTopic = solace.SolclientFactory.createTopic(replacedTopic);

  solaceMessage.setDestination(solaceTopic);
  solaceMessage.setBinaryAttachment(message);
  solaceMessage.setDeliveryMode(MessageDeliveryModeType.PERSISTENT);

  solaceSession.send(solaceMessage);
  
  // Debug: Log the topic and message being published
  console.log(`Publishing to Solace topic: ${replacedTopic}`);
  console.log(`Message: ${message}`);
}

// Function to replace variables in a topic with random values
function replaceTopicVariables(topic) {
  // Use regex to match variables in curly braces, e.g., {variable1}, {variable2}
  return topic.replace(/\{([^}]+)\}/g, (match, variableName) => {
    // Replace each variable with a random value using Faker.js
    return faker.random.word(); // Change this as needed for your use case
  });
}

// Solace connection configuration
const solaceHost = 'tcp://localhost:214';
const solaceVPN = 'default';
const solaceUsername = 'default';
const solacePassword = 'default';

// Solace session creation
const solaceSessionProperties = new solace.SessionProperties();
solaceSessionProperties.url = solaceHost;
solaceSessionProperties.vpnName = solaceVPN;
solaceSessionProperties.userName = solaceUsername;
solaceSessionProperties.password = solacePassword;

const solaceSession = solace.SolclientFactory.createSession(solaceSessionProperties);

// Entry point
if (process.argv.length !== 4) {
  console.error('Usage: node index.js <AsyncAPI_spec_file> <interval_in_ms>');
  process.exit(1);
}

const asyncapiFile = process.argv[2];
const interval = parseInt(process.argv[3], 10);

if (isNaN(interval) || interval <= 0) {
  console.error('Interval must be a positive integer in milliseconds.');
  process.exit(1);
}

const asyncapi = readAsyncAPISpec(asyncapiFile);
const { schemas, schemaToTopics } = extractSchemasAndTopics(asyncapi);

// Start the Solace session
solaceSession.connect();

solaceSession.on(solace.SessionEventCode.UP_NOTICE, (sessionEvent) => {
  console.log('Connected to Solace broker');
  // Continuously publish messages to Solace for each topic with the specified interval
  setInterval(() => {
    Object.keys(schemaToTopics).forEach((schemaName) => {
      schemaToTopics[schemaName].forEach((topic) => {
        // Publish a message with new random values in the topic
        const message = JSON.stringify(generateFakeData(schemas[schemaName]));
        publishToSolaceWithRandomVariables(topic, message);
      });
    });
  }, interval);
});

solaceSession.on(solace.SessionEventCode.DISCONNECTED, (sessionEvent) => {
  console.error('Disconnected from Solace broker');
  process.exit(1);
});
