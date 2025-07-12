from flask import Flask, request, jsonify
from flask_cors import CORS # Import CORS
import math
import ast
import operator

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# Safe operators for evaluation
safe_operators = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}

class SafeEvaluator:
    def __init__(self):
        self.operators = safe_operators

    def evaluate(self, node):
        if isinstance(node, (ast.Num, ast.Constant)): # Handle both ast.Num and ast.Constant (for newer Python versions)
            return node.n if isinstance(node, ast.Num) else node.value
        elif isinstance(node, ast.BinOp):
            left = self.evaluate(node.left)
            right = self.evaluate(node.right)
            return self.operators[type(node.op)](left, right)
        elif isinstance(node, ast.UnaryOp):
            operand = self.evaluate(node.operand)
            return self.operators[type(node.op)](operand)
        elif isinstance(node, ast.Expression): # Added to handle top-level expressions
            return self.evaluate(node.body)
        elif isinstance(node, ast.Module): # Added to handle top-level module (e.g. from ast.parse)
            if len(node.body) != 1 or not isinstance(node.body[0], ast.Expr):
                raise ValueError("Invalid expression structure")
            return self.evaluate(node.body[0].value)
        else:
            raise ValueError(f"Unsupported or unsafe operation: {type(node)}")

def safe_eval(expression):
    """Safely evaluate mathematical expressions"""
    try:
        # Replace display symbols with actual operators if they weren't already
        expression = expression.replace('×', '*').replace('÷', '/')

        # Parse the expression
        # 'eval' mode is for a single expression, 'exec' is for multiple statements.
        # We want 'eval' for calculator expressions.
        tree = ast.parse(expression, mode='eval')
        evaluator = SafeEvaluator()
        result = evaluator.evaluate(tree.body) # tree.body is the expression node for 'eval' mode

        return result
    except Exception as e:
        # Catch specific AST errors or our custom ValueError
        if isinstance(e, (SyntaxError, ValueError)):
            raise ValueError(f"Invalid expression: {e}")
        else:
            raise ValueError(f"Calculation error: {e}")

@app.route('/')
def index():
    """Serve the calculator HTML page"""
    # In a real deployment, you'd serve static files directly via a web server (e.g., Nginx)
    # For development, you can serve it, but the frontend will make API calls to /calculate etc.
    with open('calculator.html', 'r') as f:
        return f.read()

@app.route('/calculate', methods=['POST'])
def calculate():
    """Handle general expression calculations (e.g., 2+3*4)"""
    data = request.get_json()
    expression = data.get('expression', '') # Get the expression from the request body

    if not expression:
        return jsonify({'error': 'No expression provided'}), 400

    try:
        result = safe_eval(expression)
        # Format the result
        if isinstance(result, float) and result.is_integer():
            result = int(result)
        return jsonify({'result': result})
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'error': f"Calculation error: {e}"}), 500

@app.route('/calculate_function', methods=['POST'])
def calculate_function():
    """Handle special function calculations (e.g., sqrt, sin, log)"""
    try:
        data = request.json
        function = data.get('function', '')
        value_str = data.get('value', '')
        # calculator_type = data.get('calculator_type', 1) # Not used in backend logic, can be removed if not needed elsewhere

        if not function or not value_str:
            return jsonify({'error': 'Missing function or value'}), 400

        # First evaluate the value if it's an expression (e.g., sin(2+3))
        try:
            numeric_value = safe_eval(value_str)
            # Ensure it's a number after evaluation
            if not isinstance(numeric_value, (int, float)):
                 return jsonify({'error': 'Invalid input value for function'}), 400
        except ValueError as ve:
            return jsonify({'error': f"Invalid input expression for function: {ve}"}), 400
        except Exception:
            return jsonify({'error': 'Error processing input for function'}), 500

        result = None
        # Calculate based on function
        if function == 'sqrt':
            if numeric_value < 0:
                return jsonify({'error': 'Cannot calculate square root of negative number'}), 400
            result = math.sqrt(numeric_value)

        elif function == 'sin':
            result = math.sin(math.radians(numeric_value))

        elif function == 'cos':
            result = math.cos(math.radians(numeric_value))

        elif function == 'tan':
            # Add a check for angles where tan is undefined (e.g., 90, 270 degrees)
            # Using a small epsilon for floating point comparison
            angle_in_radians = math.radians(numeric_value)
            # Check for values close to pi/2 + n*pi
            if abs(math.cos(angle_in_radians)) < 1e-9: # Check if cosine is near zero
                return jsonify({'error': 'Tangent undefined for this angle'}), 400
            result = math.tan(angle_in_radians)

        elif function == 'log': # Base 10 logarithm
            if numeric_value <= 0:
                return jsonify({'error': 'Cannot calculate logarithm of non-positive number'}), 400
            result = math.log10(numeric_value)

        elif function == 'ln': # Natural logarithm
            if numeric_value <= 0:
                return jsonify({'error': 'Cannot calculate natural logarithm of non-positive number'}), 400
            result = math.log(numeric_value)

        elif function == 'exp': # e^x
            result = math.exp(numeric_value)

        elif function == 'factorial':
            # Factorial is typically defined for non-negative integers
            if not float(numeric_value).is_integer() or numeric_value < 0:
                return jsonify({'error': 'Factorial is only defined for non-negative integers'}), 400
            result = math.factorial(int(numeric_value))

        elif function == 'percent':
            result = numeric_value / 100

        elif function == 'power':
            # NOTE: This assumes x^2 (squaring) as per the original frontend button.
            # For true x^y, the frontend would need to send 'y' as well.
            result = numeric_value ** 2

        else:
            return jsonify({'error': 'Unknown function'}), 400

        # Format the result
        if isinstance(result, float):
            if result.is_integer():
                result = int(result)
            else:
                result = round(result, 10) # Round to prevent floating point inaccuracies

        return jsonify({'result': result})

    except ValueError as ve: # Catch our custom ValueError
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        # Generic error for unexpected issues
        return jsonify({'error': f"An unexpected error occurred: {e}"}), 500

@app.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    # For development: run on port 5000
    # Ensure you have 'flask_cors' installed: pip install Flask-Cors
    app.run(debug=True, host='0.0.0.0', port=5000)

