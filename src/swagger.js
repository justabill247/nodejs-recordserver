import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Stream Recorder API",
      version: "1.0.0",
      description: "API for scheduling and managing internet audio recordings"
    }
  },
  apis: ["./src/api/*.js"], // Scan route files for JSDoc comments
};

const specs = swaggerJsdoc(options);

export function setupSwagger(app) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));
}
