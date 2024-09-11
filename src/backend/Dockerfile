# Step 1: Use an official Node.js runtime as a base image
FROM node:18

# Step 2: Set the working directory inside the container
WORKDIR /app

# Step 3: Copy the package.json and package-lock.json from your project root into the container
COPY package*.json ./

# Step 4: Install dependencies
RUN npm install

# Step 5: Copy the rest of your application files to the container
COPY . .

# Step 6: Set the working directory to the backend
WORKDIR /app/src/backend

# Step 7: Expose the port the backend will run on
EXPOSE 3001

# Step 8: Command to start the backend server
CMD ["node", "server.js"]
