const db = require("../models");

const listing = (req, res) => {
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
};

const create = (req, res) => {
    const { title, type, position } = req.body;
    return db.MappingQuestion.create({
        title,
        type,
        position
    })
        .then((question) => res.send(question))
        .catch((err) => res.status(400).send(err));
};

const update = (req, res) => {
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
};

const remove = (req, res) => {
    const id = parseInt(req.params.id);
    return db.MappingQuestion.findByPk(id, { include: 'MappingOptions' })
        .then((question) => {
            return question.destroy()
                .then(() => res.send(question))
                .catch((err) => res.status(400).send(err));
        });
};


const listOptions = (req, res) => {
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
};

const createOption = (req, res) => {
    const id = parseInt(req.params.id);
    const { title, position, color } = req.body;
    return db.MappingOption.create({
        title,
        position,
        color,
        mappingQuestionId: id,
    }).then((option) => res.send(option))
        .catch((err) => res.status(400).send(err));
};

const updateOption = (req, res) => {
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
};

const removeOption = (req, res) => {
    const id = parseInt(req.params.optionId);
    return db.MappingOption.findByPk(id,)
        .then((option) => {
            return option.destroy()
                .then(() => res.send(option))
                .catch((err) => res.status(400).send(err));
        });
};

module.exports = {
    listing,
    create,
    update,
    remove,
    listOptions,
    createOption,
    updateOption,
    removeOption
};