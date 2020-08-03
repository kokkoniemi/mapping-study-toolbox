const express = require("express");
const router = express.Router();
const db = require("../models");

// RECORDS

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
            include: ['Publication', 'MappingOptions']
        }).then((records) => res.send({ count, records }))
    })
        .catch((err) => res.send(err));
});

router.get("/records/:id", function (req, res) {
    const id = parseInt(req.params.id);
    return db.Record.findByPk(id, { include: ['Publication', 'MappingOptions'] })
        .then((record) => res.send(record))
        .catch((err) => res.send(err));
});

// only enable updating the status or comment of the record
router.put("/records/:id", function (req, res) {
    const id = parseInt(req.params.id);
    return db.Record.findByPk(id, { include: ['Publication', 'MappingOptions'] })
        .then((record) => {
            const { status, editedBy, comment, MappingOptions } = req.body;
            if (status && ![null, "uncertain", "excluded", "included"].includes(status)) {
                throw new Error("Illegal value for 'status'");
            }
            return record.update({
                ...(status !== undefined ? { status } : {}),
                ...(comment !== undefined ? { comment } : {}),
                ...(MappingOptions !== undefined ? { MappingOptions } : {}),
                editedBy
            })
                .then(() => res.send(record))
                .catch((err) => res.status(400).send(err));
        });
});

router.post("/records/:recordId/mapping-options", function (req, res) {
    const recordId = parseInt(req.params.recordId);
    const { mappingOptionId, mappingQuestionId } = req.body;
    return db.RecordMappingOption.create({
        recordId,
        mappingQuestionId,
        mappingOptionId
    })
        .then(() => {
            db.MappingOption.findByPk(mappingOptionId)
                .then(option => res.send(option))
                .catch(err => res.status(400).send(err))
        })
        .catch((err) => res.status(400).send(err));
});

router.delete("/records/:recordId/mapping-options/:mappingOptionId", function (req, res) {
    const mappingOptionId = parseInt(req.params.mappingOptionId);
    const recordId = parseInt(req.params.recordId);
    return db.RecordMappingOption.destroy({ 
        where: { mappingOptionId, recordId }
    }).then((option) => {
        res.send(`${mappingOptionId} deleted successfully`);
    }).catch(err => res.status(400).send(err));
});

// MAPPING QUESTIONS

router.get("/mapping-questions", function (req, res) {
    return db.MappingQuestion.count().then(count => {
        db.MappingQuestion.findAll({
            include: db.MappingOption,
            order: [
                ['position', 'ASC'],
                [db.MappingOption, 'position', 'ASC']
            ]
        }).then((questions) => res.send({ count, questions }))
    })
        .catch((err) => res.send(err));
});

router.post("/mapping-questions", function (req, res) {
    const { title, type, position } = req.body;
    return db.MappingQuestion.create({
        title,
        type,
        position
    })
        .then((question) => res.send(question))
        .catch((err) => res.status(400).send(err));
});

router.put("/mapping-questions/:id", function (req, res) {
    const id = parseInt(req.params.id);
    return db.MappingQuestion.findByPk(id, { include: 'MappingOptions' })
        .then((question) => {
            const { title, type, position } = req.body;
            return question.update({
                ...(title !== undefined ? { title } : {}),
                ...(type !== undefined ? { type } : {}),
                ...(position !== undefined ? { position } : {}),
            })
                .then(() => res.send(question))
                .catch((err) => res.status(400).send(err));
        });
});

router.delete("/mapping-questions/:id", function (req, res) {
    const id = parseInt(req.params.id);
    return db.MappingQuestion.findByPk(id, { include: 'MappingOptions' })
        .then((question) => {
            return question.destroy()
                .then(() => res.send(question))
                .catch((err) => res.status(400).send(err));
        });
});

router.get("/mapping-questions/:id/mapping-options", function (req, res) {
    const id = parseInt(req.params.id);
    return db.MappingOption.count({ where: { mappingQuestionId: id } }).then(count => {
        db.MappingOption.findAll({
            where: { mappingQuestionId: id },
            order: [
                ['position', 'ASC']
            ]
        }).then((options) => res.send({ count, options }))
    })
        .catch((err) => res.send(err));
});

router.post("/mapping-questions/:id/mapping-options", function (req, res) {
    const id = parseInt(req.params.id);
    const { title, position, color } = req.body;
    return db.MappingOption.create({
        title,
        position,
        color,
        mappingQuestionId: id,
    }).then((option) => res.send(option))
        .catch((err) => res.status(400).send(err));
});

router.put("/mapping-questions/:id/mapping-options/:optionId", function (req, res) {
    const id = parseInt(req.params.optionId);
    return db.MappingOption.findByPk(id)
        .then((option) => {
            const { title, color, position } = req.body;
            return option.update({
                ...(title !== undefined ? { title } : {}),
                ...(color !== undefined ? { color } : {}),
                ...(position !== undefined ? { position } : {}),
            })
                .then(() => res.send(option))
                .catch((err) => res.status(400).send(err));
        });
});

router.delete("/mapping-questions/:id/mapping-options/:optionId", function (req, res) {
    const id = parseInt(req.params.optionId);
    return db.MappingOption.findByPk(id,)
        .then((option) => {
            return option.destroy()
                .then(() => res.send(option))
                .catch((err) => res.status(400).send(err));
        });
});

module.exports = router;