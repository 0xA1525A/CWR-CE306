-- Q1. Create Employee table.
CREATE TABLE Employee (
    employee_id VARCHAR(10) PRIMARY KEY,
    first_name  VARCHAR(100),
    last_name   VARCHAR(100),
    address     TEXT,
    phone_number VARCHAR(10),
    salary      DECIMAL(10, 2)
);

-- Q2. Create Product table.
CREATE TABLE Product (
    product_id   VARCHAR(10) PRIMARY KEY,
    product_name VARCHAR(200),
    description  TEXT,
    category     VARCHAR(100),
    price        DECIMAL(10, 2)
);

-- Q3. Create orders table with customer_id as a foreign key.
-- Prerequisite: a customers table with customer_id as a primary/unique key must exist.
CREATE TABLE orders (
    order_id    VARCHAR(10) PRIMARY KEY,
    customer_id VARCHAR(10),
    CONSTRAINT fk_orders_customers
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

-- Q4. Create order_items with a composite primary key and two foreign keys.
CREATE TABLE order_items (
    order_id   VARCHAR(10),
    product_id VARCHAR(10),
    PRIMARY KEY (order_id, product_id),
    CONSTRAINT fk_order_items_orders
        FOREIGN KEY (order_id) REFERENCES orders(order_id),
    CONSTRAINT fk_order_items_products
        FOREIGN KEY (product_id) REFERENCES Product(product_id)
);

-- Q5. Insert one employee.
INSERT INTO Employee
    (employee_id, first_name, last_name, salary, phone_number, address)
VALUES
    ('EMP001', 'สมชาย', 'ใจดี', 25000.00, '0812345678', 'กรุงเทพมหานคร');

-- Q6. Increase the salary of EMP001 by 10%.
UPDATE Employee
SET salary = salary * 1.10
WHERE employee_id = 'EMP001';

-- Q7. Delete products whose price is <= 0 or whose name is missing/blank.
DELETE FROM Product
WHERE price <= 0
   OR product_name IS NULL
   OR TRIM(product_name) = '';

-- Q8. Electronics products priced over 500 baht, highest price first.
SELECT product_id, product_name, price
FROM Product
WHERE category = 'Electronics'
  AND price > 500
ORDER BY price DESC;

-- Q9. Average salary and total number of employees.
SELECT AVG(salary) AS average_salary,
       COUNT(*) AS employee_count
FROM Employee;

-- Q10. Employees whose last name starts with 'ทอง'.
SELECT *
FROM Employee
WHERE last_name LIKE 'ทอง%';

-- Q11. Show each order ID and the customer's name.
-- Assumes customers has customer_id and name columns.
SELECT o.order_id,
       c.name AS customer_name
FROM orders AS o
INNER JOIN customers AS c
    ON o.customer_id = c.customer_id;

-- Q12. Show order ID, product name, and product price for every order item.
SELECT oi.order_id,
       p.product_name,
       p.price
FROM orders AS o
INNER JOIN order_items AS oi
    ON o.order_id = oi.order_id
INNER JOIN Product AS p
    ON oi.product_id = p.product_id;

-- Q13. Find customers with at least 3 orders.
SELECT customer_id,
       COUNT(*) AS order_count
FROM orders
GROUP BY customer_id
HAVING COUNT(*) >= 3;