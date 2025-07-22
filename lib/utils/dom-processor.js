import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { JSDOM, VirtualConsole } from 'jsdom';

/**
 * DOM processor for converting JSX/TSX to HTML for accessibility testing
 */

/**
 * Convert JSX/TSX code to HTML string for accessibility testing
 * @param {string} code - JSX/TSX code
 * @param {string} filename - Original filename for context
 * @returns {string} HTML string
 */
export function jsx_to_html(code, filename = 'component.jsx') {
  try {
    // Parse JSX/TSX with Babel
    const ast = parse(code, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'typescript',
        'decorators-legacy',
        'classProperties',
        'objectRestSpread',
        'asyncGenerators',
        'functionBind',
        'dynamicImport',
      ],
    });

    let jsx_elements = [];
    let html_output = '';

    // Traverse AST to find JSX elements
    traverse(ast, {
      JSXElement(path) {
        jsx_elements.push(path.node);
      },
      JSXFragment(path) {
        jsx_elements.push(path.node);
      },
      ReturnStatement(path) {
        if (path.node.argument && 
            (path.node.argument.type === 'JSXElement' || 
             path.node.argument.type === 'JSXFragment')) {
          jsx_elements.push(path.node.argument);
        }
      },
    });

    // Convert JSX elements to HTML
    if (jsx_elements.length > 0) {
      html_output = jsx_elements.map(element => jsx_element_to_html(element)).join('');
    } else {
      // If no JSX found, try to extract any HTML-like content
      html_output = extract_html_from_code(code);
    }

    // Wrap in basic HTML structure if not already wrapped
    if (!html_output.includes('<html')) {
      html_output = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accessibility Test - ${filename}</title>
</head>
<body>
  ${html_output}
</body>
</html>`;
    }

    return html_output;
  } catch (error) {
    // Fallback: try to extract HTML-like content
    return extract_html_from_code(code);
  }
}

/**
 * Convert individual JSX element to HTML
 * @param {object} element - JSX element AST node
 * @returns {string} HTML string
 */
function jsx_element_to_html(element) {
  if (!element) return '';

  try {
    if (element.type === 'JSXFragment') {
      // Handle React fragments
      const children = element.children || [];
      return children.map(child => jsx_element_to_html(child)).join('');
    }

    if (element.type === 'JSXElement') {
      const tag_name = get_jsx_tag_name(element);
      const attributes = get_jsx_attributes(element);
      const children = element.children || [];
      
      // Handle self-closing elements
      const self_closing = ['img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'];
      
      if (self_closing.includes(tag_name)) {
        return `<${tag_name}${attributes} />`;
      }

      // Handle regular elements
      const children_html = children.map(child => {
        if (child.type === 'JSXText') {
          return child.value;
        }
        if (child.type === 'JSXElement' || child.type === 'JSXFragment') {
          return jsx_element_to_html(child);
        }
        if (child.type === 'JSXExpressionContainer') {
          // Handle expressions - for accessibility testing, we'll use placeholder text
          return '[expression]';
        }
        return '';
      }).join('');

      return `<${tag_name}${attributes}>${children_html}</${tag_name}>`;
    }

    if (element.type === 'JSXText') {
      return element.value;
    }

    return '';
  } catch (error) {
    return '';
  }
}

/**
 * Get JSX tag name from element
 * @param {object} element - JSX element
 * @returns {string} Tag name
 */
function get_jsx_tag_name(element) {
  if (!element.openingElement) return 'div';
  
  const name = element.openingElement.name;
  if (name.type === 'JSXIdentifier') {
    // Convert React components to div for accessibility testing
    if (name.name[0] === name.name[0].toUpperCase()) {
      return 'div';
    }
    return name.name;
  }
  
  return 'div';
}

/**
 * Get JSX attributes as HTML string
 * @param {object} element - JSX element
 * @returns {string} HTML attributes string
 */
function get_jsx_attributes(element) {
  if (!element.openingElement || !element.openingElement.attributes) return '';
  
  const attributes = element.openingElement.attributes.map(attr => {
    if (attr.type === 'JSXAttribute') {
      const name = attr.name.name;
      
      // Convert React-specific attributes to HTML
      const html_attr = jsx_attr_to_html_attr(name);
      
      if (attr.value === null) {
        return html_attr;
      }
      
      if (attr.value.type === 'StringLiteral') {
        return `${html_attr}="${attr.value.value}"`;
      }
      
      if (attr.value.type === 'JSXExpressionContainer') {
        // For accessibility testing, use placeholder values
        return `${html_attr}="[expression]"`;
      }
    }
    return '';
  }).filter(attr => attr !== '');
  
  return attributes.length > 0 ? ` ${attributes.join(' ')}` : '';
}

/**
 * Convert JSX attribute to HTML attribute
 * @param {string} jsx_attr - JSX attribute name
 * @returns {string} HTML attribute name
 */
function jsx_attr_to_html_attr(jsx_attr) {
  const attr_map = {
    'className': 'class',
    'htmlFor': 'for',
    'tabIndex': 'tabindex',
    'contentEditable': 'contenteditable',
    'spellCheck': 'spellcheck',
    'autoComplete': 'autocomplete',
    'autoFocus': 'autofocus',
    'autoPlay': 'autoplay',
    'crossOrigin': 'crossorigin',
    'dateTime': 'datetime',
    'formAction': 'formaction',
    'formEncType': 'formenctype',
    'formMethod': 'formmethod',
    'formNoValidate': 'formnovalidate',
    'formTarget': 'formtarget',
    'frameBorder': 'frameborder',
    'marginHeight': 'marginheight',
    'marginWidth': 'marginwidth',
    'maxLength': 'maxlength',
    'minLength': 'minlength',
    'noValidate': 'novalidate',
    'readOnly': 'readonly',
    'rowSpan': 'rowspan',
    'colSpan': 'colspan',
    'useMap': 'usemap',
    'vAlign': 'valign',
    'onClick': 'onclick',
    'onChange': 'onchange',
    'onSubmit': 'onsubmit',
    'onFocus': 'onfocus',
    'onBlur': 'onblur',
    'onKeyDown': 'onkeydown',
    'onKeyUp': 'onkeyup',
    'onMouseDown': 'onmousedown',
    'onMouseUp': 'onmouseup',
    'onMouseOver': 'onmouseover',
    'onMouseOut': 'onmouseout',
  };
  
  return attr_map[jsx_attr] || jsx_attr.toLowerCase();
}

/**
 * Extract HTML-like content from code as fallback
 * @param {string} code - Source code
 * @returns {string} HTML string
 */
function extract_html_from_code(code) {
  // Simple regex to find HTML-like content
  const html_pattern = /<[^>]+>/g;
  const matches = code.match(html_pattern);
  
  if (matches) {
    return matches.join('');
  }
  
  // If no HTML found, create a basic structure
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accessibility Test</title>
</head>
<body>
  <div>No HTML content found in the provided code</div>
</body>
</html>`;
}

/**
 * Create a DOM instance from HTML string
 * @param {string} html - HTML string
 * @returns {object} JSDOM instance
 */
export function create_dom(html) {
  const dom = new JSDOM(html, {
    url: 'http://localhost',
    referrer: 'http://localhost',
    contentType: 'text/html',
    includeNodeLocations: true,
    storageQuota: 10000000,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(),
  });

  // Set up globals properly
  const window = dom.window;
  const document = window.document;
  
  // Make sure required properties exist
  if (!window.getComputedStyle) {
    window.getComputedStyle = () => ({
      getPropertyValue: () => '',
      color: 'rgb(0, 0, 0)',
      backgroundColor: 'rgb(255, 255, 255)',
    });
  }
  
  if (!window.Element) {
    window.Element = dom.window.Element;
  }

  return dom;
}

/**
 * Process CSS content for accessibility testing
 * @param {string} css - CSS content
 * @returns {string} HTML with embedded CSS
 */
export function css_to_html(css) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CSS Accessibility Test</title>
  <style>
    ${css}
  </style>
</head>
<body>
  <div class="sample-content">
    <h1>Sample Heading</h1>
    <p>Sample paragraph text for testing color contrast and readability.</p>
    <button>Sample Button</button>
    <a href="#test">Sample Link</a>
    <input type="text" placeholder="Sample Input" />
  </div>
</body>
</html>`;
}

/**
 * Determine file type and process accordingly
 * @param {string} code - Source code
 * @param {string} filename - Original filename
 * @returns {string} HTML string ready for accessibility testing
 */
export function process_code_for_accessibility(code, filename = 'file.js') {
  const extension = filename.split('.').pop().toLowerCase();
  
  switch (extension) {
    case 'jsx':
    case 'tsx':
      return jsx_to_html(code, filename);
    
    case 'css':
    case 'scss':
    case 'sass':
      return css_to_html(code);
    
    case 'html':
    case 'htm':
      // Already HTML, just ensure proper structure
      if (code.includes('<!DOCTYPE') || code.includes('<html')) {
        return code;
      }
      return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accessibility Test</title>
</head>
<body>
  ${code}
</body>
</html>`;
    
    default:
      // If it looks like HTML (contains HTML tags), treat as HTML
      if (code.includes('<html') || code.includes('<!DOCTYPE') || code.includes('<body') || code.includes('<head')) {
        return process_code_for_accessibility(code, 'file.html');
      }
      // Otherwise try to parse as JSX/TSX
      return jsx_to_html(code, filename);
  }
}