# syntax=docker/dockerfile:1

# Base image with Node.js
ARG NODE_VERSION=20.11.1
FROM node:${NODE_VERSION}-alpine as base

# Set working directory for all stages
WORKDIR /usr/src/app

################################################################################
# Dependencies stage
FROM base as deps

# Copy package.json and package-lock.json for dependency installation
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

################################################################################
# Build stage
FROM base as build

# Copy all project files into the container
COPY . .

# Install all dependencies including devDependencies for the frontend build
RUN npm ci

# Build the frontend
RUN npm run build

################################################################################
# Final stage
FROM base as final

# Set environment to production
ENV NODE_ENV production

# Copy only the necessary files from the build stage

RUN npm install -g nodemon


COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/src ./src
COPY --from=build /usr/src/app/package.json ./

# Expose port 3001 for backend
EXPOSE 3001

# Set the user to non-root for security
USER node

# Start the backend
CMD ["npm", "run", "start"]
