const express = require("express");
const router = express.Router();
const db = require("../models");


router.get("/records", function (req, res) {
    let { offset, limit, status } = req.query;
    offset = !offset ? 0 : parseInt(offset);
    limit = !limit ? 25 : parseInt(limit);
    const where = {};
    if (status !== undefined) {
        where.status = status === "null" ? null : status;
    }
    return db.Record.count({ where }).then(count => {
        db.Record.findAll({
            offset,
            limit,
            where,
            include: 'Publication'
        }).then((records) => res.send({ count, records }))
    })
        .catch((err) => res.send(err));
});

router.get("/records/:id", function (req, res) {
    const id = parseInt(req.params.id);
    return db.Record.findByPk(id, { include: 'Publication' })
        .then((record) => res.send(record))
        .catch((err) => res.send(err));
});

// only enable updating the status or comment of the record
router.put("/records/:id", function (req, res) {
    const id = parseInt(req.params.id);
    return db.Record.findByPk(id, { include: 'Publication' })
        .then((record) => {
            const { status, editedBy, comment } = req.body;
            if (status && ![null, "uncertain", "excluded", "included"].includes(status)) {
                throw new Error("Illegal value for 'status'");
            }
            return record.update({
                ...(status !== undefined ? { status } : {}),
                ...(comment !== undefined ? { comment } : {}),
                editedBy
            })
                .then(() => res.send(record))
                .catch((err) => res.status(400).send(err));
        });
});

module.exports = router;