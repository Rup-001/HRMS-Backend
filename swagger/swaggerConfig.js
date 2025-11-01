const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "HRMS API Documentation",
      version: "1.0.0",
      description: "API documentation for the HRMS project using Swagger",
      contact: {
        name: "Your Name",
        email: "your@email.com",
      },
    },
    servers: [
      {
        url: "http://localhost:5000", // change if you use different port
        description: "Local server",
      },
    ],
  },
  apis: ["./routes/*.js", './controllers/*.js'], // Swagger will read routes for comments
};

const swaggerSpec = swaggerJsDoc(options);

const swaggerDocs = (app) => {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  console.log("📄 Swagger docs available at: http://localhost:5000/api-docs");
};

module.exports = swaggerDocs;
