# Step 1: Use a Node.js image to build the frontend
FROM node:18 AS build

# Step 2: Set the working directory inside the container
WORKDIR /app/src

# Step 3: Copy the package.json and package-lock.json to install dependencies
COPY package*.json ./

# Step 4: Install frontend dependencies
RUN npm install

# Step 5: Copy the rest of the frontend source code
COPY . .

# Step 6: Build the frontend assets for production
RUN npm run build

# Step 7: Install 'serve' globally to serve the static build files
RUN npm install -g serve

# Step 8: Expose the port on which the app will run (port 5173)
EXPOSE 5173

# Step 9: Automatically serve the 'build' folder on port 5173
CMD ["serve", "-s", "build", "-l", "3000"]
