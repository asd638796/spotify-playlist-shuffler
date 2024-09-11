    # Use an official Node.js runtime as the base image
    FROM node:18

    # Set the working directory in the container
    WORKDIR /app

    # Copy package.json and package-lock.json to install dependencies
    COPY package*.json ./

    # Install dependencies
    RUN npm install

    # Copy the entire project directory to the container
    COPY . .

    # Build the frontend (assumes the frontend build is part of the npm script)
    RUN npm run build

    # Expose the port where your backend will run
    EXPOSE 3001

    # Start the backend server
    CMD ["node", "src/server.js"]
