# 1. Use an official Python runtime
FROM python:3.11-slim

# 2. Set the working directory
WORKDIR /app

# 3. Copy and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. Copy the rest of your code
COPY . .

# 5. Expose the port
EXPOSE 8000

# 6. Run using Uvicorn CLI directly
# Format: uvicorn <module_name>:<app_variable_name> --host 0.0.0.0 --port 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
