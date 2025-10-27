#!/bin/bash
echo "Starting build process..."
echo "Current directory: $(pwd)"
echo "Directory contents:"
ls -la

echo "Checking if frontend directory exists..."
if [ -d "frontend" ]; then
    echo "Frontend directory found!"
    cd frontend
    echo "Installing frontend dependencies..."
    npm ci
    echo "Building React app..."
    npm run build
    echo "Build completed!"
else
    echo "ERROR: Frontend directory not found!"
    exit 1
fi