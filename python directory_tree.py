import os
import sys


def generate_directory_tree(directory_path, output_file=None, exclude_dirs=None, exclude_extensions=None):
    """
    Generate a directory tree visualization for the given path.

    Args:
        directory_path (str): The path to scan
        output_file (str, optional): File to write the tree to. If None, prints to stdout.
        exclude_dirs (list, optional): List of directory names to exclude
        exclude_extensions (list, optional): List of file extensions to exclude
    """
    if exclude_dirs is None:
        exclude_dirs = []
    if exclude_extensions is None:
        exclude_extensions = []

    # Convert path to absolute path
    directory_path = os.path.abspath(directory_path)

    # Verify the path exists
    if not os.path.exists(directory_path):
        print(f"Error: The path '{directory_path}' does not exist.")
        return None

    # Get the base directory name
    base_name = os.path.basename(directory_path)

    # Initialize the output string with the base directory name
    tree_str = base_name + '\n'

    # Call the recursive function to build the tree
    tree_str += _generate_tree(directory_path, '', exclude_dirs, exclude_extensions)

    # Output the tree
    if output_file:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(tree_str)
        print(f"Directory tree saved to {output_file}")
    else:
        print(tree_str)

    return tree_str


def _generate_tree(directory_path, prefix, exclude_dirs, exclude_extensions):
    """
    Recursively generate the tree structure.

    Args:
        directory_path (str): Current directory path
        prefix (str): Prefix for the current level (for indentation and line drawing)
        exclude_dirs (list): List of directory names to exclude
        exclude_extensions (list): List of file extensions to exclude

    Returns:
        str: The generated tree as a string
    """
    # Get all items in the directory
    try:
        items = sorted(os.listdir(directory_path))
    except PermissionError:
        return prefix + "[Permission denied]\n"
    except Exception as e:
        return prefix + f"[Error: {str(e)}]\n"

    # Filter out excluded directories and files
    items = [item for item in items if item not in exclude_dirs and
             not any(item.endswith(ext) for ext in exclude_extensions)]

    # Initialize the tree string
    tree = ""

    # Process each item
    for i, item in enumerate(items):
        # Full path to the item
        item_path = os.path.join(directory_path, item)

        # Check if this is the last item at this level
        is_last_item = (i == len(items) - 1)

        # Choose the appropriate connector and new prefix
        if is_last_item:
            connector = "└── "
            new_prefix = prefix + "    "
        else:
            connector = "├── "
            new_prefix = prefix + "│   "

        # Add the item to the tree
        tree += prefix + connector + item + "\n"

        # If the item is a directory, recursively process it
        if os.path.isdir(item_path):
            tree += _generate_tree(item_path, new_prefix, exclude_dirs, exclude_extensions)

    return tree


def main():
    """Main function to handle user input and execute the directory tree generation."""
    # Initialize variables for customization
    exclude_dirs = []  # e.g., ['.git', '__pycache__', 'venv']
    exclude_extensions = []  # e.g., ['.pyc', '.pyo', '.pyd']
    output_file = None  # e.g., 'directory_tree.txt'

    # Check if a path was provided as a command-line argument
    if len(sys.argv) > 1:
        path = sys.argv[1]
    else:
        # Prompt the user for a directory path
        path = input("Enter the directory path to scan: ").strip()

        # Handle if the user enters an empty path
        if not path:
            print("No path provided. Using current directory.")
            path = os.getcwd()

    # Ask if user wants to customize options
    customize = input("Do you want to customize scanning options? (y/n): ").strip().lower()
    if customize == 'y':
        # Ask for directories to exclude
        exclude_input = input("Enter directories to exclude (comma-separated, or press Enter for none): ").strip()
        if exclude_input:
            exclude_dirs = [d.strip() for d in exclude_input.split(',')]

        # Ask for file extensions to exclude
        extensions_input = input(
            "Enter file extensions to exclude (comma-separated, include the dot, e.g. '.pyc,.txt', or press Enter for none): ").strip()
        if extensions_input:
            exclude_extensions = [e.strip() for e in extensions_input.split(',')]

        # Ask if user wants to save to a file
        save_to_file = input("Save the output to a file? (y/n): ").strip().lower()
        if save_to_file == 'y':
            output_file = input("Enter the output file name: ").strip()
            if not output_file:
                output_file = 'directory_tree.txt'

    # Generate the directory tree
    generate_directory_tree(path, output_file, exclude_dirs, exclude_extensions)


if __name__ == "__main__":
    main()