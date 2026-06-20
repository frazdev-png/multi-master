<?php
require_once __DIR__ . '/../config/Database.php';

class BaseModel {
    protected $table;
    protected $conn;
    protected $primaryKey = 'id';

    public function __construct($table) {
        $this->table = $table;
        $database = new Database();
        $this->conn = $database->getConnection();
    }

    // Get all records
    public function getAll() {
        $query = 'SELECT * FROM ' . $this->table;
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Get single record by ID
    public function getById($id) {
        $query = 'SELECT * FROM ' . $this->table . ' WHERE ' . $this->primaryKey . ' = :id';
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // Create new record
    public function create($data) {
        $columns = implode(', ', array_keys($data));
        $placeholders = ':' . implode(', :', array_keys($data));
        
        $query = 'INSERT INTO ' . $this->table . ' (' . $columns . ') VALUES (' . $placeholders . ')';
        $stmt = $this->conn->prepare($query);

        foreach ($data as $key => $value) {
            $stmt->bindValue(':' . $key, $value);
        }

        return $stmt->execute() ? $this->conn->lastInsertId() : false;
    }

    // Update record
    public function update($id, $data) {
        $set = [];
        foreach ($data as $key => $value) {
            $set[] = $key . ' = :' . $key;
        }
        $set = implode(', ', $set);

        $query = 'UPDATE ' . $this->table . ' SET ' . $set . ' WHERE ' . $this->primaryKey . ' = :id';
        $stmt = $this->conn->prepare($query);
        $stmt->bindValue(':id', $id);

        foreach ($data as $key => $value) {
            $stmt->bindValue(':' . $key, $value);
        }

        return $stmt->execute();
    }

    // Delete record
    public function delete($id) {
        $query = 'DELETE FROM ' . $this->table . ' WHERE ' . $this->primaryKey . ' = :id';
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);
        return $stmt->execute();
    }

    // Custom query
    public function query($sql, $params = []) {
        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }
}
?>
